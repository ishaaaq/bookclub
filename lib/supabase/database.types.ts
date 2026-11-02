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
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
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
      books: {
        Row: {
          author: string | null
          cover_url: string | null
          created_at: string
          id: string
          open_library_key: string | null
          title: string
        }
        Insert: {
          author?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          open_library_key?: string | null
          title: string
        }
        Update: {
          author?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          open_library_key?: string | null
          title?: string
        }
        Relationships: []
      }
      chapters: {
        Row: {
          city: string
          id: string
          name: string
          timezone: string
          whatsapp_url: string | null
        }
        Insert: {
          city: string
          id?: string
          name: string
          timezone?: string
          whatsapp_url?: string | null
        }
        Update: {
          city?: string
          id?: string
          name?: string
          timezone?: string
          whatsapp_url?: string | null
        }
        Relationships: []
      }
      checkins: {
        Row: {
          book_id: string
          created_at: string
          id: string
          meetup_id: string
          member_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          meetup_id: string
          member_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          meetup_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_meetup_id_fkey"
            columns: ["meetup_id"]
            isOneToOne: false
            referencedRelation: "meetups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_clock: {
        Row: {
          singleton: boolean
          today: string
        }
        Insert: {
          singleton?: boolean
          today: string
        }
        Update: {
          singleton?: boolean
          today?: string
        }
        Relationships: []
      }
      intents: {
        Row: {
          created_at: string
          meetup_id: string
          member_id: string
        }
        Insert: {
          created_at?: string
          meetup_id: string
          member_id: string
        }
        Update: {
          created_at?: string
          meetup_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intents_meetup_id_fkey"
            columns: ["meetup_id"]
            isOneToOne: false
            referencedRelation: "meetups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      meetups: {
        Row: {
          chapter_id: string
          checkin_token: string
          created_at: string
          date: string
          id: string
          note: string | null
          start_time: string
          status: Database["public"]["Enums"]["meetup_status"]
          venue_id: string
        }
        Insert: {
          chapter_id: string
          checkin_token?: string
          created_at?: string
          date: string
          id?: string
          note?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["meetup_status"]
          venue_id: string
        }
        Update: {
          chapter_id?: string
          checkin_token?: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["meetup_status"]
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetups_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetups_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          chapter_id: string
          created_at: string
          display_name: string
          hide_from_shelf: boolean
          id: string
          is_guest: boolean
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          chapter_id: string
          created_at?: string
          display_name: string
          hide_from_shelf?: boolean
          id?: string
          is_guest?: boolean
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          chapter_id?: string
          created_at?: string
          display_name?: string
          hide_from_shelf?: boolean
          id?: string
          is_guest?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "members_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          chapter_id: string
          member_id: string
          role: Database["public"]["Enums"]["role_kind"]
        }
        Insert: {
          chapter_id: string
          member_id: string
          role: Database["public"]["Enums"]["role_kind"]
        }
        Update: {
          chapter_id?: string
          member_id?: string
          role?: Database["public"]["Enums"]["role_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "roles_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule: {
        Row: {
          anchor_date: string
          chapter_id: string
          default_start_time: string
          default_venue_id: string
          id: string
          interval_days: number
        }
        Insert: {
          anchor_date: string
          chapter_id: string
          default_start_time: string
          default_venue_id: string
          id?: string
          interval_days?: number
        }
        Update: {
          anchor_date?: string
          chapter_id?: string
          default_start_time?: string
          default_venue_id?: string
          id?: string
          interval_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: true
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_default_venue_id_fkey"
            columns: ["default_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      shares: {
        Row: {
          body: string | null
          checkin_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["share_kind"]
          rating: number | null
        }
        Insert: {
          body?: string | null
          checkin_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["share_kind"]
          rating?: number | null
        }
        Update: {
          body?: string | null
          checkin_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["share_kind"]
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shares_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          chapter_id: string
          id: string
          is_default: boolean
          maps_url: string | null
          name: string
        }
        Insert: {
          address?: string | null
          chapter_id: string
          id?: string
          is_default?: boolean
          maps_url?: string | null
          name: string
        }
        Update: {
          address?: string | null
          chapter_id?: string
          id?: string
          is_default?: boolean
          maps_url?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      want_to_read: {
        Row: {
          book_id: string
          created_at: string
          member_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          member_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "want_to_read_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "want_to_read_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      chapter_today: {
        Args: { p_chapter: string }
        Returns: string
      }
      check_in: {
        Args: { p_token: string; p_book_id: string }
        Returns: string
      }
      checkin_status: {
        Args: { p_token: string }
        Returns: {
          meetup_id: string
          chapter_id: string
          date: string
          start_time: string
          status: Database["public"]["Enums"]["meetup_status"]
          venue_name: string
          is_open: boolean
        }[]
      }
      current_member_id: {
        Args: { p_chapter: string }
        Returns: string
      }
      ensure_meetup: {
        Args: { p_chapter: string; p_date: string }
        Returns: string
      }
      intent_count: {
        Args: { p_meetup: string }
        Returns: number
      }
      is_host: {
        Args: { p_chapter: string }
        Returns: boolean
      }
      is_meetup_date: {
        Args: { p_chapter: string; p_date: string }
        Returns: boolean
      }
      join_chapter: {
        Args: { p_chapter: string; p_display_name: string }
        Returns: string
      }
      meetup_checkin_token: {
        Args: { p_meetup: string }
        Returns: string
      }
      member_is_visible: {
        Args: { p_member: string }
        Returns: boolean
      }
      my_member_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
    }
    Enums: {
      meetup_status: "scheduled" | "cancelled" | "moved"
      role_kind: "host"
      share_kind: "line" | "quote" | "rating"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      meetup_status: ["scheduled", "cancelled", "moved"],
      role_kind: ["host"],
      share_kind: ["line", "quote", "rating"],
    },
  },
} as const

