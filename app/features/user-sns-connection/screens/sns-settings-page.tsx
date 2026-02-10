import { data, Form, useActionData, useSearchParams, redirect } from "react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { 
  Trash2Icon, 
  ExternalLinkIcon, 
  CheckCircle2Icon, 
  ClockIcon,
  MessageSquareIcon,
  AlertCircleIcon
} from "lucide-react";

/**
 * Server-side utilities and queries
 */
import makeServerClient from "~/core/lib/supa-client.server";
import { getAllUserSnsConnections, prepareSnsVerification } from "../queries";

/**
 * Custom Icons and Shared Components
 */
import { Hero } from "~/core/components/hero";
import { Card, CardContent } from "~/core/components/ui/card";
import { Button } from "~/core/components/ui/button";
import { Badge } from "~/core/components/ui/badge";
import { DiscordIcon, TelegramIcon } from "~/core/components/icons";

import type { Route } from "./+types/sns-settings-page";

/**
 * Page Metadata
 */
export const meta = () => [
  { title: "SNS Channels | Nudge" },
  { name: "description", content: "Manage your notification channels for language learning cards." },
];

/**
 * Loader: Fetches the authenticated user's SNS connections.
 */
export const loader = async ({ request }: Route.LoaderArgs) => {
  const [client, headers] = makeServerClient(request);
  const { data: { user } } = await client.auth.getUser();

  if (!user) throw redirect("/auth/login");

  const connections = await getAllUserSnsConnections(client, { userId: user.id });
  return data({ connections,
    env: {
      DISCORD_CLIENT_ID: process.env.DISCORD_OAUTH2_CLIENT_ID!,
      DISCORD_REDIRECT_URI: process.env.DISCORD_OAUTH2_REDIRECT_URI!,
    }
   }, { headers });
};

/**
 * Action: Manages SNS connection lifecycle (Create/Upsert, Tokenize, Delete).
 */
export const action = async ({ request }: Route.ActionArgs) => {
  const [client, headers] = makeServerClient(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const connectionId = formData.get("connectionId") as string;
  const { data: { user } } = await client.auth.getUser();

  if (!user) return redirect("/auth/login");

  try {
    /**
     * Intent: create_connection
     * Handles initial linking or re-linking with guard logic and upsert.
     */
    if (intent === "create_connection") {
      const snsType = formData.get("snsType") as "discord" | "telegram";

      // [Guard Logic] Prevent re-creating a connection if it's already verified
      const { data: existing } = await client
        .from("user_sns_connection")
        .select("id, verified_at")
        .eq("user_id", user.id)
        .eq("sns_type", snsType)
        .maybeSingle();

      if (existing?.verified_at) {
        return data({ error: `This ${snsType} account is already verified.` }, { status: 400, headers });
      }

      // [Upsert] Use upsert with onConflict to handle existing "pending" records
      const { data: connection, error: upsertError } = await client
        .from("user_sns_connection")
        .upsert(
          {
            user_id: user.id,
            sns_type: snsType,
            sns_identifier: "pending...",
            is_active: false,
          },
          { onConflict: "user_id, sns_type, sns_identifier" }
        )
        .select()
        .single();

      if (upsertError) throw upsertError;

      // Immediately generate/refresh the verification token
      const updated = await prepareSnsVerification(client, { connectionId: connection.id });
      return data({ connection: updated }, { headers });
    }

    if (intent === "generate_token") {
      const connection = await prepareSnsVerification(client, { connectionId });
      return data({ connection }, { headers });
    }

    if (intent === "delete") {
      const { error: deleteError } = await client.from("user_sns_connection").delete().eq("id", connectionId);
      if (deleteError) throw deleteError;
      return data({ success: true }, { headers });
    }
  } catch (error: any) {
    return data({ error: error.message || "Internal Server Error" }, { status: 500, headers });
  }
};

export default function SnsSettingsPage({ loaderData, actionData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const errorType = searchParams.get("error");
  const { env } = loaderData; // Get env from loaderData

  /**
   * Safe Data Merging: Narrowing union types to resolve actionData property errors
   */
  const connections = loaderData.connections.map((conn) => {
    if (actionData && "connection" in actionData && actionData.connection?.id === conn.id) {
      return actionData.connection;
    }
    return conn;
  });

  useEffect(() => {
    // Notify user if they were redirected because SNS connection is required for subscription
    if (errorType === "sns_required") {
      toast.error("SNS Required", {
        description: "Please link an account to receive your learning cards.",
      });
    }
    // Notify user about action errors (e.g., from Guard Logic)
    if (actionData && "error" in actionData) {
      toast.error("Operation Failed", { description: actionData.error });
    }
  }, [errorType, actionData]);

  const getSnsLink = (type: string, token: string) => {
    if (type === 'telegram') return `https://t.me/NudgeLearningBot?start=${token}`;
    if (type === 'discord') {
      const params = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        redirect_uri: env.DISCORD_REDIRECT_URI,
        response_type: "code",
        scope: "identify guilds.join",
        state: token,
      });
      return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
    }
    return "#";
  };

  return (
    <div className="space-y-16 pb-24 font-bold">
      <Hero 
        title="SNS Settings" 
        subtitle="Manage where you receive your daily language nudges. (Deutsch lernen leicht gemacht!)" 
      />

      <div className="container mx-auto max-w-screen-md px-4 space-y-12">
        
        {/* SECTION 1: ACTIVE & PENDING CONNECTIONS */}
        <div className="space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground ml-4 italic">
            Your Channels
          </h3>
          {connections.length > 0 ? (
            connections.map((conn) => (
              <Card key={conn.id} className="border-4 rounded-[2.5rem] overflow-hidden shadow-none border-primary/10">
                <CardContent className="p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-2xl bg-muted flex items-center justify-center">
                        {conn.sns_type === 'telegram' ? <TelegramIcon size={24} /> : <DiscordIcon size={24} />}
                      </div>
                      <div>
                        <h4 className="text-xl font-black uppercase italic tracking-tighter">{conn.sns_type}</h4>
                        <p className="text-xs text-muted-foreground font-mono uppercase">
                          {conn.verified_at ? conn.sns_identifier : "Status: Action Required"}
                        </p>
                      </div>
                    </div>
                    {conn.verified_at ? (
                      <Badge className="bg-green-500 text-[10px] font-black italic">VERIFIED</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-black italic">PENDING</Badge>
                    )}
                  </div>

                  {!conn.verified_at && (
                    <div className="bg-primary/5 p-6 rounded-3xl space-y-4 border-2 border-dashed border-primary/20">
                      {!conn.verification_token ? (
                        <Form method="post">
                          <input type="hidden" name="connectionId" value={conn.id} />
                          <Button name="intent" value="generate_token" className="w-full h-12 rounded-2xl font-black uppercase text-xs">
                            Refresh Token
                          </Button>
                        </Form>
                      ) : (
                        <div className="space-y-4">
                          <Button asChild className="w-full h-14 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl bg-primary">
                            <a href={getSnsLink(conn.sns_type, conn.verification_token)} target="_blank" rel="noreferrer">
                              Verify on {conn.sns_type} <ExternalLinkIcon className="size-4 ml-2" />
                            </a>
                          </Button>
                          <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground font-bold uppercase">
                            <ClockIcon className="size-3" /> Token active for 15 minutes
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {conn.verified_at && (
                    <div className="flex justify-between items-center pt-4 border-t border-dashed">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2Icon className="size-4" />
                        <span className="text-[10px] font-black uppercase">Connected successfully</span>
                      </div>
                      <Form method="post">
                        <input type="hidden" name="connectionId" value={conn.id} />
                        <Button variant="ghost" name="intent" value="delete" className="text-muted-foreground hover:text-destructive text-[10px] font-black uppercase">
                          Unlink Channel
                        </Button>
                      </Form>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-16 bg-muted/20 rounded-[3rem] border-4 border-dashed">
              <MessageSquareIcon className="size-12 mx-auto text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground uppercase text-xs font-black italic tracking-widest">
                No active notification channels found.
              </p>
            </div>
          )}
        </div>

        {/* SECTION 2: ADD NEW CHANNEL */}
        <div className="space-y-8 pt-12 border-t-4 border-dashed border-muted">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-black uppercase italic tracking-tighter">
              Add New Channel
            </h3>
            <p className="text-[10px] text-muted-foreground font-medium uppercase">
              Choose your preferred service to receive learning nudges.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {['telegram', 'discord'].map((type) => {
              const isConnected = connections.some(c => c.sns_type === type && c.verified_at);
              return (
                <Card key={type} className="border-4 rounded-[2.5rem] p-8 hover:border-primary transition-all group border-muted">
                  <div className="flex flex-col items-center text-center space-y-6">
                    <div className="size-20 rounded-[2rem] bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      {type === 'telegram' ? <TelegramIcon size={40} /> : <DiscordIcon size={40} />}
                    </div>
                    <Form method="post" className="w-full">
                      <input type="hidden" name="snsType" value={type} />
                      <Button 
                        name="intent" 
                        value="create_connection"
                        disabled={isConnected}
                        className="w-full h-14 rounded-2xl font-black uppercase text-xs tracking-widest"
                      >
                        {isConnected ? "Connected" : `Link ${type}`}
                      </Button>
                    </Form>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}