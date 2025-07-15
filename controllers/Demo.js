getAllPayments: async (req, res) => {
    const {
      search = "",
      payment_method,
      payment_type,
      from,
      to,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // Prepare search conditions
    const searchConditions = [];

    if (search) {
      searchConditions.push({
        $or: [
          { "memberDetails.name": { $regex: search, $options: "i" } },
          { _idStr: { $regex: search, $options: "i" } },
          { payment_method: { $regex: search, $options: "i" } },
          { payment_type: { $regex: search, $options: "i" } },
          { payment_date_str: { $regex: search, $options: "i" } },
        ],
      });
    }
    if (payment_method) {
      searchConditions.push({ payment_method });
    }
    if (payment_type) {
      searchConditions.push({ payment_type });
    }
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);

      if (fromDate.getTime() === toDate.getTime()) {
        // When the from and to dates are the same, include all events on that day
        searchConditions.push({
          payment_date: {
            $gte: fromDate,
            $lt: new Date(fromDate.getTime() + 24 * 60 * 60 * 1000), // Include until the end of the day
          },
        });
      } else {
        // When from and to dates are different, adjust the range
        searchConditions.push({
          payment_date: {
            $gte: fromDate,
            $lte: new Date(toDate.getTime() + 24 * 60 * 60 * 1000 - 1), // Include until the end of the toDate
          },
        });
      }
    }
    const queryConditions = searchConditions.length
      ? { $and: searchConditions }
      : {};
    try {
      const payments = await Payment.aggregate([
        {
          $addFields: {
            payment_date_str: {
              $dateToString: {
                format: "%d-%m-%Y", // Adjust the format as needed
                date: "$payment_date",
              },
            },
            _idStr: { $toString: "$member_id" },
          },
        },
        {
          $lookup: {
            from: process.env.DB_COLLECTION_TWO,
            localField: "member_id",
            foreignField: "_id",
            as: "memberDetails",
          },
        },
        {
          $unwind: { path: "$memberDetails", preserveNullAndEmptyArrays: true },
        },
        { $match: queryConditions },
        {
          $facet: {
            paginatedResults: [
              { $sort: { _id: -1 } },
              { $skip: (pageNum - 1) * limitNum },
              { $limit: limitNum },
              {
                $project: {
                  _id: 1,
                  amount: 1,
                  payment_type: 1,
                  payment_date: 1,
                  payment_method: 1,
                  description: 1,
                  "memberDetails._id": 1,
                  "memberDetails.name": 1,
                },
              },
            ],
            totalCount: [{ $count: "count" }],
          },
        },
      ]);

      const totalItems = payments[0]?.totalCount[0]?.count || 0; // Get total count of matching documents
      const TotalPages = Math.ceil(totalItems / limitNum);
      return res.status(200).json({
        message: "Data Fetched Suceesfully.",
        payments: payments[0].paginatedResults,
        TotalPages,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },