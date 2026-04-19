export default function Loading() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/Tesseract-1K.gif" alt="Loading" width={160} height={160} className="object-contain" />
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600">
            Loading Canvas
          </h2>
          <p className="text-sm text-purple-300/70">
            Preparing your experience design workspace
          </p>
        </div>
      </div>
    </div>
  );
}
