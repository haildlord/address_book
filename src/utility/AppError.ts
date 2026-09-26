import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class AppError extends HTTPException {
    constructor(
        message: string,
        status: ContentfulStatusCode = 500,
        public readonly details?: unknown
    ) {
        super(status, { message });
        this.name = "AppError";
    }
}