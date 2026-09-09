package com.cosmiclatte.dev.cosmiclatteweb.controller;

import com.cosmiclatte.dev.cosmiclatteweb.dto.SoundCloudAlbumDto;
import com.cosmiclatte.dev.cosmiclatteweb.service.SoundCloudService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/albums")
public class AlbumController {

    private final SoundCloudService soundCloudService;

    public AlbumController(SoundCloudService soundCloudService) {
        this.soundCloudService = soundCloudService;
    }

    @GetMapping("/soundcloud")
    public List<SoundCloudAlbumDto> soundcloud() {
        return soundCloudService.listAlbums();
    }
}
