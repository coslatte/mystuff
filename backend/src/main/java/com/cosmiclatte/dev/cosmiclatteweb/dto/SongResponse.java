package com.cosmiclatte.dev.cosmiclatteweb.dto;

import java.time.Instant;

public record SongResponse(
        Long id,
        String title,
        String artist,
        String duration,
        String audioUrl,
        Instant createdAt,
        Double avgRating,
        Long totalVotes
) {
}
