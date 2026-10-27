package com.cosmiclatte.dev.portfolio.dto;

import com.cosmiclatte.dev.portfolio.model.ForumNoteStatus;

import java.time.Instant;

public record ForumNoteResponse(
        Long id,
        String title,
        String author,
        String content,
        ForumNoteStatus status,
        Instant createdAt,
        Instant updatedAt) {
}
