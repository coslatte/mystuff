package com.cosmiclatte.dev.cosmiclatteweb.controller;

import com.cosmiclatte.dev.cosmiclatteweb.dto.CommentResponse;
import com.cosmiclatte.dev.cosmiclatteweb.dto.CreateCommentRequest;
import com.cosmiclatte.dev.cosmiclatteweb.dto.UpdateCommentRequest;
import com.cosmiclatte.dev.cosmiclatteweb.service.CommentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    @GetMapping("/songs/{songId}/comments")
    public List<CommentResponse> list(@PathVariable Long songId) {
        return commentService.listBySong(songId);
    }

    @PostMapping("/songs/{songId}/comments")
    public ResponseEntity<CommentResponse> create(
            @PathVariable Long songId,
            @RequestBody CreateCommentRequest request) {
        CommentResponse created = commentService.create(songId, request.author(), request.content());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/comments/{id}")
    public CommentResponse update(
            @PathVariable Long id,
            @RequestBody UpdateCommentRequest request,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey,
            @RequestParam(value = "editToken", required = false) String editToken) {
        return commentService.update(id, request.content(), adminKey, editToken);
    }

    @DeleteMapping("/comments/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        commentService.delete(id, adminKey);
        return ResponseEntity.noContent().build();
    }
}
