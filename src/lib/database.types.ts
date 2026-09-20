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
      gigs: {
        Row: {
          created_at: string
          id: string
          imported_at: string | null
          price_pence: number
          slug: string
          source: string
          source_ref: string | null
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
          imported_at?: string | null
          price_pence?: number
          slug: string
          source?: string
          source_ref?: string | null
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
          imported_at?: string | null
          price_pence?: number
          slug?: string
          source?: string
          source_ref?: string | null
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
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_admin: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          is_admin?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_admin?: boolean
        }
        Relationships: []
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
      gig_stats: {
        Row: {
          attending_count: number | null
          gig_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      artist_is_hypeable: { Args: { p_artist_id: string }; Returns: boolean }
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
          p_artist_name: string
          p_price_pence?: number
          p_source: string
          p_source_ref: string
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
      slugify: { Args: { p_text: string }; Returns: string }
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
          imported_at: string | null
          price_pence: number
          slug: string
          source: string
          source_ref: string | null
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
    }
    Enums: {
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
    },
  },
} as const

