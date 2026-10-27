package com.cosmiclatte.dev.portfolio.controller;

import com.cosmiclatte.dev.portfolio.common.dto.ResponseFormat;
import com.cosmiclatte.dev.portfolio.common.exception.ForbiddenException;
import com.cosmiclatte.dev.portfolio.config.AdminAuth;
import com.cosmiclatte.dev.portfolio.dto.ForumNoteRequest;
import com.cosmiclatte.dev.portfolio.dto.ForumNoteResponse;
import com.cosmiclatte.dev.portfolio.service.ForumNoteService;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.SchemaProperty;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/forum/notes")
@RequiredArgsConstructor
public class ForumController {
    private final ForumNoteService service;
    private final AdminAuth adminAuth;

    @GetMapping("/published")
    @ApiResponse(responseCode = "200", content = @Content(schema = @Schema(implementation = ResponseFormat.class),
            schemaProperties = @SchemaProperty(name = "data", array = @ArraySchema(schema = @Schema(implementation = ForumNoteResponse.class)))))
    public ResponseFormat<?> listPublished() {
        return ResponseFormat.success(service.listPublished());
    }

    @GetMapping
    @ApiResponse(responseCode = "200", content = @Content(schema = @Schema(implementation = ResponseFormat.class),
            schemaProperties = @SchemaProperty(name = "data", array = @ArraySchema(schema = @Schema(implementation = ForumNoteResponse.class)))))
    public ResponseFormat<?> list(@RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        requireAdmin(adminKey);
        return ResponseFormat.success(service.list());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseFormat<ForumNoteResponse> create(@Valid @RequestBody ForumNoteRequest body,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        requireAdmin(adminKey);
        return ResponseFormat.success(service.create(body));
    }

    @PutMapping("/{id}")
    public ResponseFormat<ForumNoteResponse> update(@PathVariable Long id, @Valid @RequestBody ForumNoteRequest body,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        requireAdmin(adminKey);
        return ResponseFormat.success(service.update(id, body));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        requireAdmin(adminKey);
        service.delete(id);
    }

    private void requireAdmin(String adminKey) {
        if (!adminAuth.isAdmin(adminKey)) throw new ForbiddenException("Admin key is required to manage forum notes.");
    }
}
