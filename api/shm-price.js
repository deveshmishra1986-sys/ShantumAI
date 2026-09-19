export default async function handler(req, res) {
  return res.status(200).json({
    success: true,
    test: "NEW SHM PRICE FILE",
    version: "2026-09-20-TEST-01"
  });
}