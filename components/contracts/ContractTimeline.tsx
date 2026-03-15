"use client";

import { CONTRACT_STATUS_FLOW } from "@/lib/contracts/status-flow";

const LABELS: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  work_submitted: "Work Submitted",
  pending_review: "Pending Review",
  approved: "Approved",
  paid: "Paid",
  closed: "Closed",
};

type Props = {
  status: string;
  vendorAssigned?: boolean;
  submissionStatus?: string | null;
};

export default function ContractTimeline({
  status,
  vendorAssigned,
  submissionStatus,
}: Props) {

  // Determine effective lifecycle stage
  let effectiveStatus = status;

  if (vendorAssigned && status === "draft") {
    effectiveStatus = "active";
  }

  if (submissionStatus) {
    effectiveStatus = "work_submitted";
  }

  if (submissionStatus === "submitted") {
    effectiveStatus = "pending_review";
  }

  if (submissionStatus === "approved") {
    effectiveStatus = "approved";
  }

  // Prevent -1 index crash
  const currentIndex = Math.max(
    CONTRACT_STATUS_FLOW.indexOf(effectiveStatus as any),
    0
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">

      <h3 className="mb-6 text-sm font-semibold text-gray-600 dark:text-gray-300">
        Contract Lifecycle
      </h3>

      <div className="flex items-center justify-between">

        {CONTRACT_STATUS_FLOW.map((step, index) => {

          const completed = index < currentIndex;
          const current = index === currentIndex;

          return (
            <div key={step} className="flex flex-1 items-center">

              {/* STEP */}
              <div className="flex flex-col items-center text-center">

                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-semibold
                  ${
                    completed
                      ? "bg-green-500 border-green-500 text-white"
                      : current
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-gray-200 border-gray-300 text-gray-500 dark:bg-white/10 dark:border-white/20"
                  }`}
                >
                  {index + 1}
                </div>

                <div
                  className={`mt-2 text-xs font-medium
                  ${
                    completed
                      ? "text-green-700 dark:text-green-400"
                      : current
                      ? "text-blue-700 dark:text-blue-400"
                      : "text-gray-400"
                  }`}
                >
                  {LABELS[step]}
                </div>

              </div>

              {/* LINE */}
              {index < CONTRACT_STATUS_FLOW.length - 1 && (
                <div
                  className={`mx-2 h-[2px] flex-1
                  ${completed ? "bg-green-500" : "bg-gray-200 dark:bg-white/10"}`}
                />
              )}

            </div>
          );
        })}

      </div>

    </div>
  );
}