package com.cosmiclatte.dev.portfolio.controller;

import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.SchemaProperty;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.web.bind.annotation.ResponseStatus;
import io.swagger.v3.oas.annotations.media.ArraySchema;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.cosmiclatte.dev.portfolio.common.ApiPaths;
import com.cosmiclatte.dev.portfolio.common.dto.ResponseFormat;
import com.cosmiclatte.dev.portfolio.dto.CommentResponse;
import com.cosmiclatte.dev.portfolio.dto.CreateCommentRequest;
import com.cosmiclatte.dev.portfolio.dto.CreatedCommentResponse;
import com.cosmiclatte.dev.portfolio.dto.UpdateCommentRequest;
import com.cosmiclatte.dev.portfolio.service.CommentService;


@RestController
@RequestMapping(ApiPaths.API)
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    @GetMapping(ApiPaths.SONG_COMMENTS)
    @ApiResponse(responseCode = "200", content = @Content(
            schema = @Schema(implementation = ResponseFormat.class),
            schemaProperties = @SchemaProperty(name = "data", array = @ArraySchema(schema = @Schema(implementation = CommentResponse.class)))))
    public ResponseFormat<?> list(@PathVariable Long songId) {
        return ResponseFormat.success(commentService.listBySong(songId));
    }

    @PostMapping(ApiPaths.SONG_COMMENTS)
    @ApiResponse(responseCode = "201", content = @Content(
            schema = @Schema(implementation = ResponseFormat.class),
            schemaProperties = @SchemaProperty(name = "data", schema = @Schema(implementation = CreatedCommentResponse.class))))
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseFormat<?> create(
            @PathVariable Long songId,
            @Valid @RequestBody CreateCommentRequest request) {
        CreatedCommentResponse created = commentService.create(songId, request.author(), request.content());
        return ResponseFormat.success(created);
    }

    @PutMapping(ApiPaths.COMMENT_ID)
    @ApiResponse(responseCode = "200", content = @Content(
            schema = @Schema(implementation = ResponseFormat.class),
            schemaProperties = @SchemaProperty(name = "data", schema = @Schema(implementation = CommentResponse.class))))
    public ResponseFormat<?> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateCommentRequest request,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey,
            @RequestHeader(value = "X-Edit-Token", required = false) String editTokenHeader,
            @RequestParam(value = "editToken", required = false) String editTokenParam) {
        // Header is the current contract. The query param stays accepted so a
        // cached older client keeps working, but it leaks into access logs, so it
        // is a fallback rather than the only option.
        String editToken = editTokenHeader != null ? editTokenHeader : editTokenParam;
        return ResponseFormat.success(commentService.update(id, request.content(), adminKey, editToken));
    }

    @DeleteMapping(ApiPaths.COMMENT_ID)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public ResponseFormat<?> delete(
            @PathVariable Long id,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        commentService.delete(id, adminKey);
        return null;
    }
}
