package com.cosmiclatte.dev.portfolio.controller;

import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.SchemaProperty;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.web.bind.annotation.ResponseStatus;
import io.swagger.v3.oas.annotations.media.ArraySchema;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.cosmiclatte.dev.portfolio.common.ApiPaths;
import com.cosmiclatte.dev.portfolio.common.dto.ResponseFormat;
import com.cosmiclatte.dev.portfolio.dto.SoundCloudAlbumDto;
import com.cosmiclatte.dev.portfolio.service.SoundCloudService;


@RestController
@RequestMapping(ApiPaths.ALBUMS)
@RequiredArgsConstructor
public class AlbumController {

    private final SoundCloudService soundCloudService;

    @GetMapping(ApiPaths.SOUNDCLOUD)
    @ApiResponse(responseCode = "200", content = @Content(
            schema = @Schema(implementation = ResponseFormat.class),
            schemaProperties = @SchemaProperty(name = "data", array = @ArraySchema(schema = @Schema(implementation = SoundCloudAlbumDto.class)))))
    public ResponseFormat<?> soundcloud() {
        return ResponseFormat.success(soundCloudService.listAlbums());
    }
}
