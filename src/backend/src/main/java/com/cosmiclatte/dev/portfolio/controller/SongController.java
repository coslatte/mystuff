package com.cosmiclatte.dev.portfolio.controller;

import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.SchemaProperty;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.web.bind.annotation.ResponseStatus;
import io.swagger.v3.oas.annotations.media.ArraySchema;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
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


@RestController
@RequestMapping(ApiPaths.SONGS)
@RequiredArgsConstructor
public class SongController {

    private final SongService songService;
    private final AdminAuth adminAuth;

    @GetMapping
    @ApiResponse(responseCode = "200", content = @Content(
            schema = @Schema(implementation = ResponseFormat.class),
            schemaProperties = @SchemaProperty(name = "data", array = @ArraySchema(schema = @Schema(implementation = SongResponse.class)))))
    public ResponseFormat<?> list(
            @RequestParam(value = "visitorId", required = false) String visitorId,
            @RequestHeader(value = "X-Forwarded-For", required = false) String forwardedFor,
            HttpServletRequest httpRequest) {
        String ipHash = ClientIp.hash(ClientIp.resolve(forwardedFor, httpRequest));
        return ResponseFormat.success(songService.listSongs(visitorId, ipHash));
    }

    @GetMapping(ApiPaths.SONG_ID)
    @ApiResponse(responseCode = "200", content = @Content(
            schema = @Schema(implementation = ResponseFormat.class),
            schemaProperties = @SchemaProperty(name = "data", schema = @Schema(implementation = SongResponse.class))))
    public ResponseFormat<?> get(@PathVariable Long id) {
        return ResponseFormat.success(songService.getSong(id));
    }

    @PostMapping(consumes = "multipart/form-data")
    @ApiResponse(responseCode = "201", content = @Content(
            schema = @Schema(implementation = ResponseFormat.class),
            schemaProperties = @SchemaProperty(name = "data", schema = @Schema(implementation = SongResponse.class))))
    @ResponseStatus(HttpStatus.CREATED)
    public ResponseFormat<?> create(
            @RequestPart("title") String title,
            @RequestPart("artist") String artist,
            @RequestPart("file") MultipartFile file,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        requireAdmin(adminKey);
        return ResponseFormat.success(songService.createSong(title, artist, file));
    }

    @PutMapping(value = ApiPaths.SONG_AUDIO, consumes = "multipart/form-data")
    @ApiResponse(responseCode = "200", content = @Content(
            schema = @Schema(implementation = ResponseFormat.class),
            schemaProperties = @SchemaProperty(name = "data", schema = @Schema(implementation = SongResponse.class))))
    public ResponseFormat<?> replaceAudio(
            @PathVariable Long id,
            @RequestPart("file") MultipartFile file,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        requireAdmin(adminKey);
        return ResponseFormat.success(songService.replaceAudio(id, file));
    }

    @DeleteMapping(ApiPaths.SONG_ID)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public ResponseFormat<?> delete(
            @PathVariable Long id,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        requireAdmin(adminKey);
        songService.deleteSong(id);
        return null;
    }

    private void requireAdmin(String adminKey) {
        if (!adminAuth.isAdmin(adminKey)) {
            throw new ForbiddenException("Admin key is required to manage songs.");
        }
    }
}
