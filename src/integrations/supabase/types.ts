export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      events: {
        Row: {
          canceled_at: string | null;
          confirmation_deadline: string | null;
          created_at: string;
          created_by: string;
          description: string | null;
          ends_at: string;
          id: string;
          location_address: string | null;
          location_link: string | null;
          location_name: string;
          modality: "futsal" | "fut7" | "campo11" | "custom";
          players_per_team: number;
          has_goalkeeper: boolean;
          defenders: number;
          midfielders: number;
          attackers: number;
          game_style_id: string | null;
          section_id: string;
          starts_at: string;
          status: "scheduled" | "canceled";
          title: string;
          updated_at: string;
          vacancy_count: number;
        };
        Insert: {
          canceled_at?: string | null;
          confirmation_deadline?: string | null;
          created_at?: string;
          created_by: string;
          description?: string | null;
          ends_at: string;
          id?: string;
          location_address?: string | null;
          location_link?: string | null;
          location_name?: string;
          modality: "futsal" | "fut7" | "campo11" | "custom";
          players_per_team?: number;
          has_goalkeeper?: boolean;
          defenders?: number;
          midfielders?: number;
          attackers?: number;
          game_style_id?: string | null;
          section_id: string;
          starts_at: string;
          status?: "scheduled" | "canceled";
          title: string;
          updated_at?: string;
          vacancy_count?: number;
        };
        Update: {
          canceled_at?: string | null;
          confirmation_deadline?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          ends_at?: string;
          id?: string;
          location_address?: string | null;
          location_link?: string | null;
          location_name?: string;
          modality?: "futsal" | "fut7" | "campo11" | "custom";
          players_per_team?: number;
          has_goalkeeper?: boolean;
          defenders?: number;
          midfielders?: number;
          attackers?: number;
          game_style_id?: string | null;
          section_id?: string;
          starts_at?: string;
          status?: "scheduled" | "canceled";
          title?: string;
          updated_at?: string;
          vacancy_count?: number;
        };
        Relationships: [];
      };
      event_attendance: {
        Row: {
          event_id: string;
          id: string;
          player_id: string;
          responded_at: string | null;
          responded_by: string | null;
          status: "PENDING" | "CONFIRMED" | "DECLINED";
          waitlist_position: number | null;
        };
        Insert: {
          event_id: string;
          id?: string;
          player_id: string;
          responded_at?: string | null;
          responded_by?: string | null;
          status?: "PENDING" | "CONFIRMED" | "DECLINED";
          waitlist_position?: number | null;
        };
        Update: {
          event_id?: string;
          id?: string;
          player_id?: string;
          responded_at?: string | null;
          responded_by?: string | null;
          status?: "PENDING" | "CONFIRMED" | "DECLINED";
          waitlist_position?: number | null;
        };
        Relationships: [];
      };
      players: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          overall: number;
          photo_url: string | null;
          position: string;
          section_id: string | null;
          user_id: string;
          skills: Json;
          weak_foot: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          overall?: number;
          photo_url?: string | null;
          position: string;
          section_id?: string | null;
          user_id: string;
          skills?: Json;
          weak_foot?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          overall?: number;
          photo_url?: string | null;
          position?: string;
          section_id?: string | null;
          user_id?: string;
          skills?: Json;
          weak_foot?: number;
        };
        Relationships: [];
      };
      section_players: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          overall: number;
          photo_url: string | null;
          position: string;
          section_id: string;
          skills: Json;
          user_id: string | null;
          weak_foot: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          overall?: number;
          photo_url?: string | null;
          position: string;
          section_id: string;
          skills?: Json;
          user_id?: string | null;
          weak_foot?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          overall?: number;
          photo_url?: string | null;
          position?: string;
          section_id?: string;
          skills?: Json;
          user_id?: string | null;
          weak_foot?: number;
        };
        Relationships: [];
      };
      sections: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          invite_code: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          invite_code?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          invite_code?: string;
          name?: string;
        };
        Relationships: [];
      };
      game_styles: {
        Row: {
          id: string;
          section_id: string;
          name: string;
          players_per_team: number;
          has_goalkeeper: boolean;
          defenders: number;
          midfielders: number;
          attackers: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          section_id: string;
          name: string;
          players_per_team: number;
          has_goalkeeper?: boolean;
          defenders?: number;
          midfielders?: number;
          attackers?: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["game_styles"]["Insert"]>;
        Relationships: [];
      };
      section_members: {
        Row: {
          joined_at: string;
          section_id: string;
          user_id: string;
        };
        Insert: {
          joined_at?: string;
          section_id: string;
          user_id: string;
        };
        Update: {
          joined_at?: string;
          section_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_section_event: {
        Args: {
          p_ends_at: string;
          p_modality: string;
          p_section_id: string;
          p_starts_at: string;
          p_title: string;
          p_game_style_id?: string | null;
        };
        Returns: string;
      };
      create_game_style: {
        Args: {
          p_section_id: string;
          p_name: string;
          p_players_per_team: number;
          p_has_goalkeeper: boolean;
          p_defenders: number;
          p_midfielders: number;
          p_attackers: number;
        };
        Returns: string;
      };
      update_game_style: {
        Args: {
          p_id: string;
          p_section_id: string;
          p_name: string;
          p_players_per_team: number;
          p_has_goalkeeper: boolean;
          p_defenders: number;
          p_midfielders: number;
          p_attackers: number;
        };
        Returns: undefined;
      };
      delete_game_style: { Args: { p_id: string; p_section_id: string }; Returns: undefined };
      create_section: {
        Args: { p_name: string };
        Returns: string;
      };
      delete_section: {
        Args: { p_section_id: string };
        Returns: undefined;
      };
      get_my_section: {
        Args: Record<PropertyKey, never>;
        Returns: {
          invite_code: string;
          is_admin: boolean;
          member_count: number;
          name: string;
          section_id: string;
        }[];
      };
      get_section_members: {
        Args: { p_section_id: string };
        Returns: {
          is_admin: boolean;
          joined_at: string;
          player_name: string | null;
          user_id: string;
        }[];
      };
      join_section: {
        Args: { p_invite_code: string };
        Returns: string;
      };
      leave_section: {
        Args: { p_section_id: string };
        Returns: undefined;
      };
      remove_section_member: {
        Args: { p_section_id: string; p_user_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
