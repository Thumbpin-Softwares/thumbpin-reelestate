import Collapsible from "@/modules/usage/components/collapsible"

const data = [
  {
    question : "Do you offer a trial for paid plans?",
    answer : "No we do not offer any trial of the paid plan until and unless requested by the customer.",
  },
  {
    question : "Can I really cancel anytime?",
    answer : "Yes, absolutely. If you want to cancel your plan, simply go to your dashboard and select 'Billing' in the top left dropdown and click on 'Turn off auto-renewal'. If you do cancel, you will continue to have access to all the premium features until the end of your billing cycle.",
  },
  {
    question : "What currencies and payment options are available",
    answer : "All the prices are listed in INR. We accept all major debit cards and credit cards as our payment system uses Razorpay which is one of the most secured and reliable payemnt aggregator. If you have any problems in the payment please feel free to contact us.",
  },
  {
    question : "How do AI credits work?",
    answer : "Your plan includes set amount of credits each month or year to spend on AI generations. Your full allowance refreshes when your subscription renews, so you get a fresh batch to use. Credits do no carry over, and you can move to a higher plan whenever you need more.",
  }
];

export default function Faq() {
  return (
    <main className="flex py-12 items-center flex-col gap-4 justify-center">
      <h1 className="text-6xl pb-12">Frequently Asked Questions</h1>
      {data.map((item, index) => (
        <Collapsible key={index} question={item.question} answer={item.answer} />
      ))}
    </main>
  )
}
