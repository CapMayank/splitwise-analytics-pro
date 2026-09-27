import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    let finalToken = token.trim();
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://secure.splitwise.com/'
    };

    if (finalToken.includes('Bearer ')) {
      headers['Authorization'] = finalToken;
    } else if (finalToken.includes('_splitwise_session=')) {
      headers['Cookie'] = finalToken;
    } else if (finalToken.length > 50 && !finalToken.includes('=')) {
      // User probably pasted the raw value of _splitwise_session from a cookie editor
      headers['Cookie'] = `_splitwise_session=${finalToken}`;
    } else {
      headers['Authorization'] = `Bearer ${finalToken}`;
    }

    // Fetch expenses
    const response = await fetch('https://secure.splitwise.com/api/v3.0/get_expenses?limit=1000', {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Splitwise API returned ${response.status}: ${response.statusText}. Please verify your token.` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.expenses) {
        return NextResponse.json({ error: 'Invalid response from Splitwise API' }, { status: 500 });
    }

    // Transform API response to match our CSV Transaction format
    const parsedData: any[] = [];
    const userNames = new Set<string>();

    data.expenses.forEach((exp: any) => {
        if (exp.deleted_at) return;

        const usersRecord: Record<string, number> = {};
        exp.users.forEach((u: any) => {
            let name = u.user.first_name || 'Unknown';
            if (u.user.last_name) name += ` ${u.user.last_name}`;
            const netBalance = parseFloat(u.net_balance || '0');
            usersRecord[name] = netBalance;
            userNames.add(name);
        });

        parsedData.push({
            Date: exp.date.split('T')[0], // YYYY-MM-DD
            Description: exp.description || 'Unknown',
            Category: exp.category?.name || 'General',
            Cost: parseFloat(exp.cost || '0'),
            Currency: exp.currency_code || 'INR',
            users: usersRecord
        });
    });

    return NextResponse.json({
        data: parsedData,
        users: Array.from(userNames)
    });

  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
