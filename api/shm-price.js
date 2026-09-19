export default async function handler(req, res) {
  return res.status(200).json({
    success: true,
    test: "SHM API IS WORKING",
    version: "TEST-002"
  });
}