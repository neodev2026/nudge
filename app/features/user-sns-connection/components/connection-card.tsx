import { Card, CardContent, CardFooter } from "~/core/components/ui/card";
import { Button } from "~/core/components/ui/button";

/**
 * Modern Connection Card using Deep Links and OAuth redirects.
 * This replaces the manual ID input for a better user experience.
 */
export function ConnectionCard({ type }: { type: 'telegram' | 'kakao' | 'discord' }) {
    const connectionLinks = {
      // Deep link to Telegram bot with a unique session token for verification
      telegram: "https://t.me/YourNudgeBot?start=USER_UNIQUE_TOKEN",
      // Standard OAuth2 flow for Discord
      discord: "https://discord.com/api/oauth2/authorize?client_id=...",
      // Kakao Channel link
      kakao: "http://pf.kakao.com/_xxxx/chat"
    };
  
    return (
      <Card className="border-2 rounded-[2rem] p-6 flex flex-col items-center text-center space-y-4">
        <div className="size-16 rounded-3xl bg-muted flex items-center justify-center">
          {/* SNS specific icon */}
        </div>
        <div className="space-y-1">
          <h4 className="text-xl font-black uppercase italic tracking-tighter">{type}</h4>
          <p className="text-xs text-muted-foreground font-medium uppercase">
            {type === 'telegram' ? 'Instant Bot Sync' : 'Official OAuth Link'}
          </p>
        </div>
        
        <Button 
          asChild 
          className="w-full h-12 rounded-2xl font-black uppercase text-xs tracking-widest shadow-md"
        >
          <a href={connectionLinks[type]} target="_blank" rel="noopener noreferrer">
            Connect {type}
          </a>
        </Button>
        
        <p className="text-[10px] text-muted-foreground font-medium uppercase leading-relaxed">
          * You will be redirected to the official {type} page to verify your account.
        </p>
      </Card>
    );
  }