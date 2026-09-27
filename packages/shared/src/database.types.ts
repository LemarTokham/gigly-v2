export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      artists: {
        Row: {
          art_band: string[]
          art_palette: number
          art_seed: number
          bio: string | null
          claimed_by: string | null
          clip_url: string | null
          created_at: string
          from_area: string | null
          genre: string
          genre_group: Database["public"]["Enums"]["genre_group"]
          id: string
          links: Json
          name: string
          photo_url: string | null
          slug: string
        }
        Insert: {
          art_band?: string[]
          art_palette?: number
          art_seed?: number
          bio?: string | null
          claimed_by?: string | null
          clip_url?: string | null
          created_at?: string
          from_area?: string | null
          genre: string
          genre_group: Database["public"]["Enums"]["genre_group"]
          id?: string
          links?: Json
          name: string
          photo_url?: string | null
          slug: string
        }
        Update: {
          art_band?: string[]
          art_palette?: number
          art_seed?: number
          bio?: string | null
          claimed_by?: string | null
          clip_url?: string | null
          created_at?: string
          from_area?: string | null
          genre?: string
          genre_group?: Database["public"]["Enums"]["genre_group"]
          id?: string
          links?: Json
          name?: string
          photo_url?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "artists_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "friend_links"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "artists_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attending: {
        Row: {
          created_at: string
          gig_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gig_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          gig_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attending_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "artist_chart"
            referencedColumns: ["next_gig_id"]
          },
          {
            foreignKeyName: "attending_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gig_stats"
            referencedColumns: ["gig_id"]
          },
          {
            foreignKeyName: "attending_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attending_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "friend_links"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "attending_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "friend_links"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "friend_links"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          artist_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_chart"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_stats"
            referencedColumns: ["artist_id"]
          },
          {
            foreignKeyName: "follows_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "friend_links"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          cancelled_at: string | null
          created_at: string
          requester_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["friendship_status"]
        }
        Insert: {
          addressee_id: string
          cancelled_at?: string | null
          created_at?: string
          requester_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["friendship_status"]
        }
        Update: {
          addressee_id?: string
          cancelled_at?: string | null
          created_at?: string
          requester_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["friendship_status"]
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "friend_links"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "friend_links"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gig_artists: {
        Row: {
          artist_id: string
          gig_id: string
          position: number
        }
        Insert: {
          artist_id: string
          gig_id: string
          position?: number
        }
        Update: {
          artist_id?: string
          gig_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "gig_artists_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_chart"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gig_artists_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_stats"
            referencedColumns: ["artist_id"]
          },
          {
            foreignKeyName: "gig_artists_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gig_artists_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "artist_chart"
            referencedColumns: ["next_gig_id"]
          },
          {
            foreignKeyName: "gig_artists_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gig_stats"
            referencedColumns: ["gig_id"]
          },
          {
            foreignKeyName: "gig_artists_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
        ]
      }
      gig_moments: {
        Row: {
          fires_at: string
          gig_id: string
          notified_at: string | null
        }
        Insert: {
          fires_at: string
          gig_id: string
          notified_at?: string | null
        }
        Update: {
          fires_at?: string
          gig_id?: string
          notified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gig_moments_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: true
            referencedRelation: "artist_chart"
            referencedColumns: ["next_gig_id"]
          },
          {
            foreignKeyName: "gig_moments_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: true
            referencedRelation: "gig_stats"
            referencedColumns: ["gig_id"]
          },
          {
            foreignKeyName: "gig_moments_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: true
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
        ]
      }
      gigs: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          imported_at: string | null
          price_pence: number
          slug: string
          source: string
          source_ref: string | null
          source_title: string | null
          starts_at: string
          status: Database["public"]["Enums"]["gig_status"]
          submitted_as: string | null
          submitted_by: string | null
          ticket_url: string | null
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          imported_at?: string | null
          price_pence?: number
          slug: string
          source?: string
          source_ref?: string | null
          source_title?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["gig_status"]
          submitted_as?: string | null
          submitted_by?: string | null
          ticket_url?: string | null
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          imported_at?: string | null
          price_pence?: number
          slug?: string
          source?: string
          source_ref?: string | null
          source_title?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["gig_status"]
          submitted_as?: string | null
          submitted_by?: string | null
          ticket_url?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gigs_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "friend_links"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "gigs_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gigs_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      hypes: {
        Row: {
          artist_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hypes_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_chart"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hypes_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_stats"
            referencedColumns: ["artist_id"]
          },
          {
            foreignKeyName: "hypes_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hypes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "friend_links"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "hypes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_admin: boolean
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_admin?: boolean
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_admin?: boolean
          username?: string | null
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "friend_links"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string
          reaction: Database["public"]["Enums"]["reaction_code"]
          stub_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reaction: Database["public"]["Enums"]["reaction_code"]
          stub_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          reaction?: Database["public"]["Enums"]["reaction_code"]
          stub_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_stub_id_fkey"
            columns: ["stub_id"]
            isOneToOne: false
            referencedRelation: "stubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "friend_links"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_user_id: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          stub_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_user_id: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          stub_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reported_user_id?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          stub_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "friend_links"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "friend_links"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "friend_links"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_stub_id_fkey"
            columns: ["stub_id"]
            isOneToOne: false
            referencedRelation: "stubs"
            referencedColumns: ["id"]
          },
        ]
      }
      stubs: {
        Row: {
          audience: Database["public"]["Enums"]["stub_audience"]
          back_path: string
          created_at: string
          front_path: string
          gig_id: string
          id: string
          people: number
          thumb_path: string
          user_id: string
        }
        Insert: {
          audience: Database["public"]["Enums"]["stub_audience"]
          back_path: string
          created_at?: string
          front_path: string
          gig_id: string
          id?: string
          people: number
          thumb_path: string
          user_id: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["stub_audience"]
          back_path?: string
          created_at?: string
          front_path?: string
          gig_id?: string
          id?: string
          people?: number
          thumb_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stubs_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "artist_chart"
            referencedColumns: ["next_gig_id"]
          },
          {
            foreignKeyName: "stubs_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gig_stats"
            referencedColumns: ["gig_id"]
          },
          {
            foreignKeyName: "stubs_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "gigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stubs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "friend_links"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "stubs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      username_holds: {
        Row: {
          held_until: string
          user_id: string
          username: string
        }
        Insert: {
          held_until: string
          user_id: string
          username: string
        }
        Update: {
          held_until?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "username_holds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "friend_links"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "username_holds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          area: string
          capacity: number | null
          created_at: string
          google_place_id: string | null
          id: string
          lat: number | null
          lng: number | null
          map_x: number | null
          map_y: number | null
          name: string
          skiddle_id: number | null
          slug: string
        }
        Insert: {
          area: string
          capacity?: number | null
          created_at?: string
          google_place_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          map_x?: number | null
          map_y?: number | null
          name: string
          skiddle_id?: number | null
          slug: string
        }
        Update: {
          area?: string
          capacity?: number | null
          created_at?: string
          google_place_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          map_x?: number | null
          map_y?: number | null
          name?: string
          skiddle_id?: number | null
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      artist_chart: {
        Row: {
          art_band: string[] | null
          art_palette: number | null
          art_seed: number | null
          from_area: string | null
          genre: string | null
          genre_group: Database["public"]["Enums"]["genre_group"] | null
          hype_count: number | null
          id: string | null
          is_new: boolean | null
          name: string | null
          next_gig_id: string | null
          next_gig_slug: string | null
          next_gig_starts_at: string | null
          next_venue_name: string | null
          next_venue_slug: string | null
          photo_url: string | null
          position: number | null
          position_yesterday: number | null
          slug: string | null
        }
        Relationships: []
      }
      artist_stats: {
        Row: {
          artist_id: string | null
          follower_count: number | null
        }
        Relationships: []
      }
      friend_links: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          since: string | null
          state: string | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
      gig_stats: {
        Row: {
          attending_count: number | null
          gig_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      are_friends: { Args: { a: string; b: string }; Returns: boolean }
      artist_is_hypeable: { Args: { p_artist_id: string }; Returns: boolean }
      can_post_stub: { Args: { p_gig_id: string }; Returns: boolean }
      can_read_stub_photo: { Args: { p_name: string }; Returns: boolean }
      can_upload_stub_photo: { Args: { p_name: string }; Returns: boolean }
      cancel_request: { Args: { p_to: string }; Returns: undefined }
      cast_hype: {
        Args: { p_artist_id: string }
        Returns: {
          artist_id: string
          created_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "hypes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      gig_is_visible: { Args: { p_gig_id: string }; Returns: boolean }
      hype_week_start: { Args: { p_at?: string }; Returns: string }
      hypes_remaining: { Args: never; Returns: number }
      import_gig: {
        Args: {
          p_artist_links?: Json
          p_artist_name: string
          p_artist_photo?: string
          p_genre?: string
          p_genre_group?: Database["public"]["Enums"]["genre_group"]
          p_image_url?: string
          p_price_pence?: number
          p_source: string
          p_source_ref: string
          p_source_title?: string
          p_starts_at: string
          p_support?: string[]
          p_ticket_url?: string
          p_venue_slug: string
        }
        Returns: {
          gig_id: string
          gig_slug: string
          outcome: Database["public"]["Enums"]["import_outcome"]
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_blocked_between: { Args: { a: string; b: string }; Returns: boolean }
      lock_pair: { Args: { a: string; b: string }; Returns: undefined }
      profile_counts: {
        Args: { p_user_id: string }
        Returns: {
          friends: number
          going: number
          stubs: number
        }[]
      }
      react: {
        Args: {
          p_reaction: Database["public"]["Enums"]["reaction_code"]
          p_stub_id: string
        }
        Returns: Database["public"]["Enums"]["reaction_code"]
      }
      register_push_token: {
        Args: { p_platform: string; p_token: string }
        Returns: undefined
      }
      remove_friend: { Args: { p_other: string }; Returns: undefined }
      respond_to_request: {
        Args: { p_accept: boolean; p_from: string }
        Returns: string
      }
      send_friend_request: { Args: { p_to: string }; Returns: string }
      set_username: { Args: { p_username: string }; Returns: string }
      slugify: { Args: { p_text: string }; Returns: string }
      stub_window_open: { Args: { p_gig_id: string }; Returns: boolean }
      submit_gig: {
        Args: {
          p_artist_name: string
          p_price_pence: number
          p_starts_at: string
          p_submitted_as?: string
          p_ticket_url?: string
          p_venue_id: string
        }
        Returns: {
          created_at: string
          id: string
          image_url: string | null
          imported_at: string | null
          price_pence: number
          slug: string
          source: string
          source_ref: string | null
          source_title: string | null
          starts_at: string
          status: Database["public"]["Enums"]["gig_status"]
          submitted_as: string | null
          submitted_by: string | null
          ticket_url: string | null
          venue_id: string
        }
        SetofOptions: {
          from: "*"
          to: "gigs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      take_back_hype: { Args: { p_artist_id: string }; Returns: undefined }
      unique_artist_slug: { Args: { p_base: string }; Returns: string }
      unique_gig_slug: { Args: { p_base: string }; Returns: string }
      unregister_push_token: { Args: { p_token: string }; Returns: undefined }
      username_is_reserved: { Args: { p_username: string }; Returns: boolean }
    }
    Enums: {
      friendship_status: "pending" | "accepted" | "declined"
      genre_group:
        | "Indie"
        | "Punk"
        | "Jazz"
        | "Electronic"
        | "Folk"
        | "Soul"
        | "Hip hop"
      gig_status: "pending" | "live" | "rejected"
      import_outcome: "created" | "updated" | "duplicate"
      reaction_code: "fire" | "hands" | "heart_eyes" | "laugh" | "horns"
      report_reason:
        | "nudity"
        | "violence"
        | "harassment"
        | "spam"
        | "not_at_gig"
        | "other"
      stub_audience: "friends" | "wall"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      friendship_status: ["pending", "accepted", "declined"],
      genre_group: [
        "Indie",
        "Punk",
        "Jazz",
        "Electronic",
        "Folk",
        "Soul",
        "Hip hop",
      ],
      gig_status: ["pending", "live", "rejected"],
      import_outcome: ["created", "updated", "duplicate"],
      reaction_code: ["fire", "hands", "heart_eyes", "laugh", "horns"],
      report_reason: [
        "nudity",
        "violence",
        "harassment",
        "spam",
        "not_at_gig",
        "other",
      ],
      stub_audience: ["friends", "wall"],
    },
  },
} as const

