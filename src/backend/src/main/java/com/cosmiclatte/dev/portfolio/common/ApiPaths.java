package com.cosmiclatte.dev.portfolio.common;

/**
 * Route constants.
 *
 * <p>Constants are either absolute (starting at {@link #API}) or fragments to
 * append to a controller's own mapping. {@link #SONG_COMMENTS} and
 * {@link #SONG_RATINGS} look absolute but are not: their controllers mount at
 * {@link #API}, not at {@link #SONGS}.
 */
public final class ApiPaths {

    private ApiPaths() {
    }

    public static final String API = "/api";

    public static final String CONTACT_MESSAGES = API + "/contact/messages";
    public static final String CONTACT_RUNNER = API + "/internal/contact/deliveries/process";

    // Kept separate from SONGS so the two mappings below can be derived from it.
    // Annotation values must be compile-time constants, so this cannot be a
    // substring() call.
    private static final String SONGS_PATH = "/songs";

    public static final String SONGS = API + SONGS_PATH;
    public static final String SONG_ID = "/{id}";
    public static final String SONG_AUDIO = "/{id}/audio";

    public static final String ALBUMS = API + "/albums";
    public static final String SOUNDCLOUD = "/soundcloud";

    // Relative, not absolute: CommentController and RatingController mount at
    // API rather than at SONGS. Prefixing API here produced /api/api/comments.
    public static final String COMMENT_ID = "/comments/{id}";

    public static final String SONG_COMMENTS = SONGS_PATH + "/{songId}/comments";
    public static final String SONG_RATINGS = SONGS_PATH + "/{songId}/ratings";
}
