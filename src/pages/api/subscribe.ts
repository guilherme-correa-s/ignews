import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { stripe } from "../../services/sripe";
import { query as q } from 'faunadb'
import { faunadb } from "../../services/faunadb";

type User = {
  ref: {
    id: string
  },
  data: {
    strip_customer_id: string
  }
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse
) {
  try {
    if (request.method === "POST") {
      const session = await getSession({ req: request });

      const user = await faunadb.query<User>(
        q.Get(
          q.Match(
            q.Index('user_by_email'),
            q.Casefold(session.user.email)
          )
        )
      )

      let customerId = user.data.strip_customer_id;

      if (!customerId) {
        const stripCustomer = await stripe.customers.create({
          email: session.user.email,
        });

        await faunadb.query(
          q.Update(
            q.Ref(q.Collection('users'), user.ref.id),
            {
              data: {
                stripe_customer_id: stripCustomer.id
              }
            }
          )
        )

        customerId = stripCustomer.id
      }

      const stripeCheckoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        billing_address_collection: "required",
        line_items: [{ price: "price_1KhwmKAV0pLwxplFQ8ANH1ZN", quantity: 1 }],
        mode: "subscription",
        allow_promotion_codes: true,
        success_url: "http://localhost:3000/posts",
        cancel_url: "http://localhost:3000/",
      });

      return response.status(200).json({ sessionId: stripeCheckoutSession.id });
    } else {
      response.setHeader("Allow", "POST");

      return response.status(405).end("Method not allowed");
    }
  } catch (error) {
    return response.status(500).send({ error: error.message });
  }
}
