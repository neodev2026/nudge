import { Resend } from "resend";
import { render } from "@react-email/components"
import { WelcomeUserEmail } from "react-email-starter/emails/welcome-user" 

const client = new Resend(process.env.RESEND_API_KEY);

export const loader = async () => {
    const { data, error } = await client.emails.send({
        from: 'Nudge <nudge@mail.neowithai.com>',
        to: ['neo.dev.2026@gmail.com']  ,
        subject: 'welcome to Nudge',
        react: <WelcomeUserEmail username={'NEO2'} />
    });
    return Response.json({ data, error });
}