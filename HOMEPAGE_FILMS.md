# Homepage campaign films

The homepage plays four muted films in sequence: the existing Admin-selected hero film, Work, Weekend, After Hours, then returns to the first. Each advances when it ends rather than on a timer. Pause/play applies to the active film. Reduced-motion and data-saving preferences show a poster until the visitor chooses Play. Broken clips are skipped; if all fail, the existing hero poster remains.

The three supplied files were optimized to H.264 MP4, at most 1280 pixels wide, with audio removed and fast-start metadata. Source files in Downloads were preserved. Each new clip has its own loading poster. Only the active video is loaded.

Additional film paths and their playback order are in shared/hero-films.mjs. The existing first film and poster remain configurable through the current website Admin. The four default MP4s are served from the public Supabase Storage bucket `storefront-films`. The player resolves legacy bundled paths to those cloud URLs, including paths already saved in website settings. Custom Admin-selected media and local posters keep their existing behavior. The MP4s retained in GitHub are backups and are optional for running the app. The website and API still require a running host.
