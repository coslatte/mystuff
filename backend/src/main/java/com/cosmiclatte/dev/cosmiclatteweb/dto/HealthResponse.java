package com.cosmiclatte.dev.cosmiclatteweb.dto;

/**
 * Liveness probe payload. Wrapped in {@code ResponseFormat} like every other
 * endpoint so the frontend can unwrap one envelope shape for all of them.
 */
public record HealthResponse(
        String status,
        String service
) {
}
