package com.cosmiclatte.dev.portfolio.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.cosmiclatte.dev.portfolio.common.ApiPaths;
import com.cosmiclatte.dev.portfolio.common.ClientIp;
import com.cosmiclatte.dev.portfolio.common.dto.ResponseFormat;
import com.cosmiclatte.dev.portfolio.common.exception.ForbiddenException;
import com.cosmiclatte.dev.portfolio.config.AdminAuth;
import com.cosmiclatte.dev.portfolio.dto.SongResponse;
import com.cosmiclatte.dev.portfolio.service.SongService;

import java.util.List;

/*
 * Return types are spelled out instead of `ResponseEntity<?>` because the
 * OpenAPI document springdoc publishes is what the frontend generates its
 * TypeScript types from. A wildcard here degrades every schema to `object`.
 */
@RestController
@RequestMapping(ApiPaths.SONGS)
@RequiredArgsConstructor
public class SongController {

    private final SongService songService;
    private final AdminAuth adminAuth;

    @GetMapping
    public ResponseEntity<ResponseFormat<List<SongResponse>>> list(
            @RequestParam(value = "visitorId", required = false) String visitorId,
            @RequestHeader(value = "X-Forwarded-For", required = false) String forwardedFor,
            HttpServletRequest httpRequest) {
        String ipHash = ClientIp.hash(ClientIp.resolve(forwardedFor, httpRequest));
        return ResponseEntity.ok(ResponseFormat.success(songService.listSongs(visitorId, ipHash)));
    }

    @GetMapping(ApiPaths.SONG_ID)
    public ResponseEntity<ResponseFormat<SongResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ResponseFormat.success(songService.getSong(id)));
    }

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<ResponseFormat<SongResponse>> create(
            @RequestPart("title") String title,
            @RequestPart("artist") String artist,
            @RequestPart("file") MultipartFile file,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        requireAdmin(adminKey);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ResponseFormat.success(songService.createSong(title, artist, file)));
    }

    @PutMapping(value = ApiPaths.SONG_AUDIO, consumes = "multipart/form-data")
    public ResponseEntity<ResponseFormat<SongResponse>> replaceAudio(
            @PathVariable Long id,
            @RequestPart("file") MultipartFile file,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        requireAdmin(adminKey);
        return ResponseEntity.ok(ResponseFormat.success(songService.replaceAudio(id, file)));
    }

    @DeleteMapping(ApiPaths.SONG_ID)
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        requireAdmin(adminKey);
        songService.deleteSong(id);
        return ResponseEntity.noContent().build();
    }

    private void requireAdmin(String adminKey) {
        if (!adminAuth.isAdmin(adminKey)) {
            throw new ForbiddenException("Admin key is required to manage songs.");
        }
    }
}
