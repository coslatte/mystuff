package com.cosmiclatte.dev.portfolio.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;

import java.util.UUID;

public record CreateContactMessageRequest(
        @NotNull UUID submissionId,
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Email @Size(max = 254)
        @Pattern(regexp = CreateContactMessageRequest.ADDRESS_PATTERN,
                message = "Enter an email address with an ASCII mailbox and domain.") String email,
        @NotBlank @Size(min = 10, max = 5000) String message,
        @Size(max = 0) String website) {
    public static final String ADDRESS_PATTERN = "[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}";
    public CreateContactMessageRequest {
        name = name == null ? null : name.strip();
        email = email == null ? null : email.strip();
        message = message == null ? null : message.strip();
    }
}
