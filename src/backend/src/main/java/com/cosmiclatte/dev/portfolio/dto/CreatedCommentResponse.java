package com.cosmiclatte.dev.portfolio.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * Returned only to the creator right after posting a comment. The edit token is
 * a bearer secret: whoever holds it can edit the comment within the edit window,
 * so it must never be exposed in the public comment listing.
 */
@Schema(
        name = "CreatedCommentResponse",
        requiredProperties = {"id", "songId", "author", "content", "createdAt"})
public record CreatedCommentResponse(
        Long id,
        Long songId,
        String author,
        String content,
        Instant createdAt,
        Instant updatedAt,
        String editToken
) {
}