package com.cosmiclatte.dev.portfolio.common.exception;

import org.springframework.http.HttpStatus;

public class ContactException extends RuntimeException {
    private final HttpStatus status;
    private final long retryAfter;

    public ContactException(HttpStatus status, String message) {
        this(status, message, 0);
    }

    public ContactException(HttpStatus status, String message, long retryAfter) {
        super(message);
        this.status = status;
        this.retryAfter = retryAfter;
    }

    public HttpStatus status() { return status; }
    public long retryAfter() { return retryAfter; }
}
