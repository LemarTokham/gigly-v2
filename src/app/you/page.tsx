import { TopBar } from "@/components/top-bar";
import { Icon } from "@/components/icon";

export const metadata = { title: "You" };

export default function YouPage() {
  return (
    <>
      <TopBar />
      <div className="border-line bg-card mt-1.5 flex items-center gap-4 rounded-2xl border p-4">
        <span className="flex gap-1" role="img" aria-label="3 of 3 hypes left">
          {[0, 1, 2].map((i) => (
            <Icon key={i} name="flame" className="text-hype size-10" />
          ))}
        </span>
        <span>
          <b className="font-display block text-lg leading-[1.15] font-normal">3 hypes left</b>
          <span className="text-soft text-sm">Fresh ones every Monday</span>
        </span>
      </div>

      <div className="border-line text-soft mt-4 rounded-2xl border-2 border-dashed px-4 py-[22px] text-center">
        Signing in arrives in step 3. Following, going and hyping land with it.
      </div>
    </>
  );
}
