export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'Vary': 'Cookie',
};

export function jsonResponse(value: unknown, status = 200) {
  return Response.json(value, { status, headers: privateHeaders });
}
