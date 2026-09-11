package com.cosmiclatte.dev.cosmiclatteweb.controller;

import com.cosmiclatte.dev.cosmiclatteweb.common.ApiPaths;
import com.cosmiclatte.dev.cosmiclatteweb.common.dto.ResponseFormat;
import com.cosmiclatte.dev.cosmiclatteweb.dto.CommentResponse;
import com.cosmiclatte.dev.cosmiclatteweb.dto.CreatedCommentResponse;
import com.cosmiclatte.dev.cosmiclatteweb.dto.CreateCommentRequest;
import com.cosmiclatte.dev.cosmiclatteweb.dto.UpdateCommentRequest;
import com.cosmiclatte.dev.cosmiclatteweb.service.CommentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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

@RestController
@RequestMapping(ApiPaths.API)
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    @GetMapping(ApiPaths.SONG_COMMENTS)
    public ResponseEntity<?> list(@PathVariable Long songId) {
        return ResponseEntity.ok(ResponseFormat.success(commentService.listBySong(songId)));
    }

    @PostMapping(ApiPaths.SONG_COMMENTS)
    public ResponseEntity<?> create(
            @PathVariable Long songId,
            @Valid @RequestBody CreateCommentRequest request) {
        CreatedCommentResponse created = commentService.create(songId, request.author(), request.content());
        return ResponseEntity.status(HttpStatus.CREATED).body(ResponseFormat.success(created));
    }

    @PutMapping(ApiPaths.COMMENT_ID)
    public ResponseEntity<?> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateCommentRequest request,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey,
            @RequestParam(value = "editToken", required = false) String editToken) {
        return ResponseEntity.ok(
                ResponseFormat.success(commentService.update(id, request.content(), adminKey, editToken)));
    }

    @DeleteMapping(ApiPaths.COMMENT_ID)
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        commentService.delete(id, adminKey);
        return ResponseEntity.noContent().build();
    }
}
