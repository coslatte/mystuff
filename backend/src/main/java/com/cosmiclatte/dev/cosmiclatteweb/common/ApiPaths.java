package com.cosmiclatte.dev.cosmiclatteweb.common;

public final class ApiPaths {

    private ApiPaths() {
    }

    public static final String API = "/api";

    public static final String SONGS = API + "/songs";
    public static final String SONG_ID = "/{id}";
    public static final String SONG_AUDIO = "/{id}/audio";

    public static final String ALBUMS = API + "/albums";
    public static final String SOUNDCLOUD = "/soundcloud";

    public static final String SONG_COMMENTS = "/songs/{songId}/comments";
    public static final String SONG_RATINGS = "/songs/{songId}/ratings";
    public static final String COMMENT_ID = "/comments/{id}";
}
