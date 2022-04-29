import { NextApiRequest, NextApiResponse } from "next";
import { Readable } from "stream";
import Stripe from "stripe";
import { stripe } from "../../services/sripe";
import { saveSubscription } from "./_lib/manageSubscription";

async function buffer(readable: Readable) {
  const chunks = [];

  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

export const config = {
  api: {
    bodyParser: false,
  },
};

const relevantEvents = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export default async (request: NextApiRequest, response: NextApiResponse) => {
  if (request.method === "POST") {
    const buf = await buffer(request);
    const secret = request.headers["stripe-signature"];
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        buf,
        secret,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      return response.status(400).send({ error: error.message });
    }

    const typeEvent = event.type;

    if (relevantEvents.has(typeEvent)) {
      try {
        const subscription = event.data.object as Stripe.Subscription;
        switch (typeEvent) {
          case "customer.subscription.updated":
            await saveSubscription(
              subscription.id,
              subscription.customer.toString(),
            );
            break;
          case "customer.subscription.deleted":
            await saveSubscription(
              subscription.id,
              subscription.customer.toString()
            );
            break;
          case "checkout.session.completed":
            const checkoutSession = event.data
              .object as Stripe.Checkout.Session;
            await saveSubscription(
              checkoutSession.subscription.toString(),
              checkoutSession.customer.toString(),
              true
            );
            break;
          default:
            throw new Error("Unhandled event.");
        }
      } catch (error) {
        return response.json({ error: "Webhook handler failed" });
      }
    }

    return response.json({ received: true });
  } else {
    response.setHeader("Allow", "POST");

    return response.status(405).end("Method not allowed");
  }
};
