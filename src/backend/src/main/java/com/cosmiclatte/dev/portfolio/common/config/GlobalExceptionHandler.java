package com.cosmiclatte.dev.portfolio.common.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.cosmiclatte.dev.portfolio.common.dto.ResponseFormat;
import com.cosmiclatte.dev.portfolio.common.exception.BadRequestException;
import com.cosmiclatte.dev.portfolio.common.exception.ContactException;
import com.cosmiclatte.dev.portfolio.common.exception.ForbiddenException;
import com.cosmiclatte.dev.portfolio.common.exception.NotFoundException;
import com.cosmiclatte.dev.portfolio.common.exception.StorageException;

import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/*
 * Every handler returns {@code ResponseFormat<Object>}: an error body always
 * carries {@code data = null} and puts the detail in {@code errors} and
 * {@code meta}. Spelling the generic out (rather than {@code ResponseEntity<?>})
 * is what lets springdoc publish a concrete schema, which the frontend then
 * turns into TypeScript types.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    public static final String ERROR_ID_HEADER = "X-Error-Id";

    @ExceptionHandler(ContactException.class)
    public ResponseEntity<ResponseFormat<Object>> handleContact(ContactException ex) {
        ResponseEntity.BodyBuilder response = ResponseEntity.status(ex.status());
        if (ex.retryAfter() > 0) response.header("Retry-After", Long.toString(ex.retryAfter()));
        return response.body(ResponseFormat.error(ex.getMessage(), null, metaOf(generateErrorId(), ex.status())));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ResponseFormat<Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, Object> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(error -> errors.put(error.getField(), error.getDefaultMessage()));
        return buildError(HttpStatus.BAD_REQUEST,
                "Some fields are invalid. Please review them and try again.", errors, ex);
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ResponseFormat<Object>> handleNotFound(NotFoundException ex) {
        return buildError(HttpStatus.NOT_FOUND, ex.getMessage(), null, ex);
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ResponseFormat<Object>> handleForbidden(ForbiddenException ex) {
        return buildError(HttpStatus.FORBIDDEN, ex.getMessage(), null, ex);
    }

    @ExceptionHandler({BadRequestException.class, IllegalArgumentException.class})
    public ResponseEntity<ResponseFormat<Object>> handleBadRequest(RuntimeException ex) {
        return buildError(HttpStatus.BAD_REQUEST, ex.getMessage(), null, ex);
    }

    @ExceptionHandler({
            HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class,
            MissingServletRequestPartException.class
    })
    public ResponseEntity<ResponseFormat<Object>> handleMalformedRequest(Exception ex) {
        return buildError(HttpStatus.BAD_REQUEST, "Malformed request.", null, ex);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ResponseFormat<Object>> handleNoResource(NoResourceFoundException ex) {
        return buildError(HttpStatus.NOT_FOUND, "Resource not found.", null, ex);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ResponseFormat<Object>> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        return buildError(HttpStatus.METHOD_NOT_ALLOWED, "Method not allowed.", null, ex);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ResponseFormat<Object>> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        return buildError(HttpStatus.BAD_REQUEST, "File exceeds the maximum allowed size.", null, ex);
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ResponseFormat<Object>> handleMultipart(MultipartException ex) {
        return buildError(HttpStatus.BAD_REQUEST, "Invalid file request.", null, ex);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ResponseFormat<Object>> handleConflict(DataIntegrityViolationException ex) {
        // V6's unique indexes on rating mean a repeat vote from the same browser
        // or network loses the race when two requests land together. That is a
        // conflict the caller can retry, not a server fault.
        return buildError(HttpStatus.CONFLICT,
                "That vote was already recorded. Reload to see the current score.", null, ex);
    }

@ExceptionHandler(StorageException.class)
    public ResponseEntity<ResponseFormat<Object>> handleStorage(StorageException ex) {
        // Never echo the Supabase body: it can carry bucket policy details.
        return buildError(HttpStatus.BAD_GATEWAY, "Audio storage is unavailable.", null, ex);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ResponseFormat<Object>> handleGeneric(Exception ex) {
        return buildError(HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected error occurred. Please try again later.", null, ex);
    }

    private ResponseEntity<ResponseFormat<Object>> buildError(
            HttpStatus status, String message, Object errors, Exception ex) {
        String errorId = generateErrorId();

        if (status.is5xxServerError()) {
            log.error("Unhandled error [{}]: {}", errorId, ex.getMessage(), ex);
        } else {
            log.warn("Request failed [{}] {} - {}", errorId, status.value(), ex.getClass().getSimpleName());
        }

        return ResponseEntity.status(status)
                .header(ERROR_ID_HEADER, errorId)
                .body(ResponseFormat.error(message, errors, metaOf(errorId, status)));
    }

    private Map<String, Object> metaOf(String errorId, HttpStatus status) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("errorId", errorId);
        meta.put("status", status.value());
        meta.put("timestamp", Instant.now().toString());
        return meta;
    }

    private String generateErrorId() {
        return "ERR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
    }
}
