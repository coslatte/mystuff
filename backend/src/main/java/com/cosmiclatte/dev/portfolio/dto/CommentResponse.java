package com.cosmiclatte.dev.portfolio.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * A comment as the public listing shows it. {@code updatedAt} is absent until the
 * comment has been edited.
 */
@Schema(
        name = "CommentResponse",
        requiredProperties = {"id", "songId", "author", "content", "createdAt"})
public record CommentResponse(
        Long id,
        Long songId,
        String author,
        String content,
        Instant createdAt,
        Instant updatedAt
) {
}