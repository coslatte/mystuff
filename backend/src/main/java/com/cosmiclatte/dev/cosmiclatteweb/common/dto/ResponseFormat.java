package com.cosmiclatte.dev.cosmiclatteweb.common.dto;

import java.util.Map;

public record ResponseFormat<T>(
        boolean success,
        String message,
        T data,
        Map<String, Object> meta,
        Object errors
) {

    public static <T> ResponseFormat<T> success(T data) {
        return new ResponseFormat<>(true, null, data, null, null);
    }

    public static <T> ResponseFormat<T> success(T data, String message) {
        return new ResponseFormat<>(true, message, data, null, null);
    }

    public static <T> ResponseFormat<T> error(String message, Object errors) {
        return new ResponseFormat<>(false, message, null, null, errors);
    }
}
