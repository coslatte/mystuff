package com.cosmiclatte.dev.cosmiclatteweb.common.exception;

/**
 * Supabase Storage rejected a request or was unreachable. Distinct from
 * {@link BadRequestException} so the handler can log it as a server-side fault
 * instead of blaming the caller for a bad upload.
 */
public class StorageException extends RuntimeException {

    public StorageException(String message) {
        super(message);
    }

    public StorageException(String message, Throwable cause) {
        super(message, cause);
    }
}