package com.cosmiclatte.dev.cosmiclatteweb.dto;

import java.time.Instant;

public record RatingResponse(
        Long id,
        Long songId,
        int stars,
        Instant createdAt
) {
}
