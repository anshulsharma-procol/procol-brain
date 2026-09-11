import { Bell } from 'lucide-react'

/** Notification bell + user avatar, shared by the Home header and TopBar. */
export default function HeaderActions() {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-50"
      >
        <Bell className="h-5 w-5" strokeWidth={2} />
        <span className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-semibold text-white">
          1
        </span>
      </button>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
        AS
      </div>
    </div>
  )
}
