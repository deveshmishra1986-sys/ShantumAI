export default async function handler(req, res) {
  res.status(200).json({
    success: true,
    version: "PAGINATION-TEST-V2",
    message: "NEW TOKENS.JS IS DEPLOYED"
  });
}
