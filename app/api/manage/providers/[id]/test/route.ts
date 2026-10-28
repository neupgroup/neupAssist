import { NextResponse } from "next/server";
import { extractOutputByFormat, renderCurlTemplate, RESPONSE_FORMAT_SEPARATOR } from "../../../../../curl-template";
import { logApplicationError } from "../../../../../server-logger";
import { prisma } from "../../../../../../prisma/client/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "A valid provider ID is required." }, { status: 400 });
  let secret = "";

  try {
    let body: unknown = null;
    try { body = await request.json(); } catch { /* Use the saved provider template when no draft is sent. */ }
    const draft = body && typeof body === "object" && typeof (body as { reqMethod?: unknown }).reqMethod === "string"
      ? (body as { reqMethod: string }).reqMethod
      : null;
    const provider = await prisma.intelligenceProvider.findUnique({ where: { id } });
    if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });
    const reqMethod = draft ?? provider.reqMethod;
    if (!reqMethod?.trim()) return NextResponse.json({ error: "Enter a provider request method before testing it." }, { status: 400 });

    const [models, key] = await Promise.all([
      prisma.intelligenceModel.findMany({
        where: { provider_id: id, status: { equals: "active", mode: "insensitive" } },
        orderBy: [{ order_index: "asc" }, { added_on: "asc" }],
        select: { id: true, code: true },
      }),
      prisma.intelligenceKey.findFirst({
        where: {
          model_id: null,
          OR: [
            { provider: { equals: provider.name, mode: "insensitive" } },
            { provider: { equals: provider.code, mode: "insensitive" } },
          ],
        },
        orderBy: { addedOn: "desc" },
        select: { key: true },
      }),
    ]);
    if (!key) return NextResponse.json({ error: "Add a provider key with no model selected before testing." }, { status: 409 });
    if (!models.length) return NextResponse.json({ error: "Add an active model for this provider before testing." }, { status: 409 });
    const model = models[0];
    secret = key.key;

    const [curlTemplate, ...responseFormatParts] = reqMethod.split(RESPONSE_FORMAT_SEPARATOR);
    const responseFormat = responseFormatParts.length ? responseFormatParts.join(RESPONSE_FORMAT_SEPARATOR).trim() : null;
    const curl = renderCurlTemplate(curlTemplate, {
      model: model.code,
      provider: provider.code,
      input: "Hello World",
      apikey: secret,
    });
    if (!curlTemplate.includes("{{apikey}}") && !curl.headers.has("authorization") && !curl.headers.has("x-api-key") && !curl.headers.has("x-goog-api-key")) {
      if (provider.code.toLowerCase() === "anthropic") curl.headers.set("x-api-key", secret);
      else if (provider.code.toLowerCase() === "google") curl.headers.set("x-goog-api-key", secret);
      else curl.headers.set("authorization", `Bearer ${secret}`);
    }
    if (!curl.headers.has("content-type") && curl.body !== undefined) curl.headers.set("content-type", "application/json");

    const response = await fetch(curl.url, {
      method: curl.method,
      headers: curl.headers,
      body: curl.body,
      signal: AbortSignal.timeout(60_000),
    });
    const responseBody = await response.text();
    if (!response.ok) {
      const parsed = (() => { try { return JSON.parse(responseBody); } catch { return null; } })();
      const detail = typeof parsed?.error?.message === "string" ? parsed.error.message : typeof parsed?.message === "string" ? parsed.message : responseBody.slice(0, 1000);
      const safeDetail = detail.replaceAll(secret, "[API key redacted]");
      return NextResponse.json({ error: `Provider returned HTTP ${response.status}${safeDetail ? `: ${safeDetail}` : "."}` }, { status: 502 });
    }

    let output: string;
    if (responseFormat) {
      output = extractOutputByFormat(responseBody, responseFormat);
    } else {
      try { output = JSON.stringify(JSON.parse(responseBody), null, 2); }
      catch { output = responseBody; }
    }
    return NextResponse.json({ success: true, input: "Hello World", model: model.code, output });
  } catch (error) {
    await logApplicationError(error, "POST /api/manage/providers/[id]/test", secret ? [secret] : []);
    const rawMessage = error instanceof Error ? error.message : "Could not run the provider test.";
    const message = secret ? rawMessage.replaceAll(secret, "[API key redacted]") : rawMessage;
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
