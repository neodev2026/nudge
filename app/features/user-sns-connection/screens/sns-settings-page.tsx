import { data, useSearchParams, Form } from "react-router";
import { 
  SendIcon, 
  MessageSquareIcon, 
  MailIcon, 
  CheckCircle2Icon, 
  AlertTriangleIcon,
  Trash2Icon,
  StarIcon,
  PlusIcon
} from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

// Server-side utilities
import makeServerClient from "~/core/lib/supa-client.server";
import { getAllUserSnsConnections } from "../queries";

// Common UI components
import { Hero } from "~/core/components/hero";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "~/core/components/ui/card";
import { Button } from "~/core/components/ui/button";
import { Badge } from "~/core/components/ui/badge";
import { Input } from "~/core/components/ui/input";

import type { Route } from "./+types/sns-settings-page";

/**
 * [wemake Style] Loader: Fetch current user and their SNS connections.
 */
export const loader = async ({ request }: Route.LoaderArgs) => {
  const [client, headers] = makeServerClient(request);
  const { data: { user } } = await client.auth.getUser();

  if (!user) throw new Response("Unauthorized", { status: 401 });

  const connections = await getAllUserSnsConnections(client, { userId: user.id });

  return data({ connections }, { headers });
};

/**
 * [wemake Style] Action: Handle connection management (Delete, Set Primary).
 */
export const action = async ({ request }: Route.ActionArgs) => {
  const [client, headers] = makeServerClient(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const connectionId = formData.get("connectionId") as string;

  if (intent === "delete") {
    await client.from("user_sns_connection").delete().eq("id", connectionId);
  }

  return data({ success: true }, { headers });
};

export default function SnsSettingsPage({ loaderData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const errorType = searchParams.get("error");

  // Show error toast if redirected from subscription page
  useEffect(() => {
    if (errorType === "sns_required") {
      toast.error("SNS Connection Required", {
        description: "Please connect at least one SNS channel to subscribe to Nudge products.",
      });
    }
  }, [errorType]);

  const snsIcons: Record<string, any> = {
    telegram: <SendIcon className="size-5 text-sky-500" />,
    kakao: <MessageSquareIcon className="size-5 text-yellow-500" />,
    email: <MailIcon className="size-5 text-primary" />,
  };

  return (
    <div className="space-y-12 pb-20 font-bold">
      <Hero 
        title="SNS Connections" 
        subtitle="Manage your notification channels for receiving Nudge learning cards." 
      />

      <div className="container mx-auto max-w-screen-md px-4 space-y-8">
        {/* Error Alert for Nudge Requirement */}
        {errorType === "sns_required" && (
          <div className="bg-destructive/10 border-2 border-destructive/20 p-6 rounded-[2rem] flex items-center gap-4">
            <AlertTriangleIcon className="size-6 text-destructive" />
            <p className="text-sm text-destructive font-black uppercase tracking-tight">
              Action Required: Connect an SNS account to start your subscription.
            </p>
          </div>
        )}

        {/* List of Existing Connections */}
        <div className="grid grid-cols-1 gap-4">
          {loaderData.connections.map((conn) => (
            <Card key={conn.id} className="border-2 shadow-none rounded-3xl overflow-hidden">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-muted rounded-2xl">
                    {snsIcons[conn.sns_type] || <MessageSquareIcon className="size-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-black uppercase tracking-tighter">{conn.sns_type}</h4>
                      {conn.is_primary && (
                        <Badge className="bg-yellow-400 text-black border-none text-[10px] font-black italic">PRIMARY</Badge>
                      )}
                      {!conn.verified_at && (
                        <Badge variant="outline" className="text-[10px] font-black opacity-50">UNVERIFIED</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">{conn.sns_identifier}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Form method="post">
                    <input type="hidden" name="connectionId" value={conn.id} />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      name="intent" 
                      value="delete"
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2Icon className="size-5" />
                    </Button>
                  </Form>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Empty State */}
          {loaderData.connections.length === 0 && (
            <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed rounded-[2rem] bg-muted/5">
              <p className="text-muted-foreground text-sm font-bold uppercase italic opacity-50">No connections found</p>
            </div>
          )}
        </div>

        {/* Add New Connection Form */}
        <Card className="border-4 border-primary/20 shadow-xl rounded-[2.5rem] overflow-hidden bg-primary/5">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
              <PlusIcon className="size-5" /> Connect New Channel
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">SNS Provider</label>
                <select className="w-full h-12 rounded-2xl border-2 bg-background px-4 font-bold text-sm focus:ring-2 ring-primary transition-all appearance-none">
                  <option value="telegram">Telegram</option>
                  <option value="kakao">KakaoTalk</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Identifier (ID/Phone)</label>
                <Input placeholder="@username or ID" className="h-12 border-2 rounded-2xl font-bold" />
              </div>
            </div>
            <Button className="w-full h-14 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg">
              Verify & Connect
            </Button>
            <p className="text-[10px] text-center text-muted-foreground font-medium uppercase leading-relaxed">
              * To complete verification, you may need to send a code to our official bot.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}