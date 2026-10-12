package com.cosmiclatte.dev.portfolio.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/*
 * Required components are declared explicitly. Java's wrapper types make every
 * record component nullable as far as springdoc is concerned, so without this
 * the published schema marks even `id` and `title` optional and the generated
 * TypeScript turns every field into `T | undefined`.
 *
 * audioUrl, avgRating, totalVotes and myRating are genuinely absent for a song
 * with no stored audio, no ratings, or no vote from this visitor, so they stay
 * optional on purpose.
 */
@Schema(
        name = "SongResponse",
        requiredProperties = {"id", "title", "artist", "duration", "createdAt"})
public record SongResponse(
        Long id,
        String title,
        String artist,
        String duration,
        String audioUrl,
        Instant createdAt,
        Double avgRating,
        Long totalVotes,
        Integer myRating
) {
}