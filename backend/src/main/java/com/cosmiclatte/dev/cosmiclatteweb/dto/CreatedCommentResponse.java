package com.cosmiclatte.dev.cosmiclatteweb.dto;

import java.time.Instant;

/**
 * Returned only to the creator right after posting a comment. The edit token
 * is a bearer secret: whoever holds it can edit the comment within the edit
 * window, so it must never be exposed in the public comment listing.
 */
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
