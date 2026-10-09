package com.cosmiclatte.dev.portfolio.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Liveness probe payload. Wrapped in {@code ResponseFormat} like every other
 * endpoint so the frontend can unwrap one envelope shape for all of them.
 */
@Schema(name = "HealthResponse")
public record HealthResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String status,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String service
) {
}