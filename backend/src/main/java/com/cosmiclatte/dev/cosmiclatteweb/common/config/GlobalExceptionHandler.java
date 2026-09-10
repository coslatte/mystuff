package com.cosmiclatte.dev.cosmiclatteweb.common.config;

import com.cosmiclatte.dev.cosmiclatteweb.common.dto.ResponseFormat;
import com.cosmiclatte.dev.cosmiclatteweb.common.exception.BadRequestException;
import com.cosmiclatte.dev.cosmiclatteweb.common.exception.ForbiddenException;
import com.cosmiclatte.dev.cosmiclatteweb.common.exception.NotFoundException;
import lombok.extern.slf4j.Slf4j;
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

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ResponseFormat<?>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, Object> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(error -> errors.put(error.getField(), error.getDefaultMessage()));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ResponseFormat.error("Validation error", errors));
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ResponseFormat<?>> handleNotFound(NotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ResponseFormat.error(ex.getMessage(), null));
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ResponseFormat<?>> handleForbidden(ForbiddenException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ResponseFormat.error(ex.getMessage(), null));
    }

    @ExceptionHandler({BadRequestException.class, IllegalArgumentException.class})
    public ResponseEntity<ResponseFormat<?>> handleBadRequest(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ResponseFormat.error(ex.getMessage(), null));
    }

    @ExceptionHandler({
            HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class,
            MissingServletRequestPartException.class
    })
    public ResponseEntity<ResponseFormat<?>> handleMalformedRequest(Exception ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ResponseFormat.error("Malformed request.", null));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ResponseFormat<?>> handleNoResource(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ResponseFormat.error("Resource not found.", null));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ResponseFormat<?>> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(ResponseFormat.error("Method not allowed.", null));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ResponseFormat<?>> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ResponseFormat.error("File exceeds the maximum allowed size.", null));
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ResponseFormat<?>> handleMultipart(MultipartException ex) {
        log.error("Multipart error", ex);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ResponseFormat.error("Invalid file request.", null));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ResponseFormat<?>> handleGeneric(Exception ex) {
        log.error("Unhandled error", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ResponseFormat.error("Unexpected error.", null));
    }
}
