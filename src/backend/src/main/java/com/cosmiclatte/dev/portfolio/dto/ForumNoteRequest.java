package com.cosmiclatte.dev.portfolio.dto;

import com.cosmiclatte.dev.portfolio.model.ForumNoteStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ForumNoteRequest(
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 100) String author,
        @NotBlank @Size(max = 200000) String content,
        @NotNull ForumNoteStatus status) {
}
