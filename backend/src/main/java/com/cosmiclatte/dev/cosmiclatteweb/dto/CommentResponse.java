package com.cosmiclatte.dev.cosmiclatteweb.dto;

import java.time.Instant;

public record CommentResponse(
        Long id,
        Long songId,
        String author,
        String content,
        Instant createdAt,
        Instant updatedAt,
        String editToken
) {
}
