package com.cosmiclatte.dev.portfolio.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(
        name = "RatingResponse",
        requiredProperties = {"id", "songId", "stars", "createdAt"})
public record RatingResponse(
        Long id,
        Long songId,
        int stars,
        Instant createdAt
) {
}